// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createHash, randomUUID } from "node:crypto";

import { empty } from "../packages/board-rules/src/document.ts";

const noop = () => {};

let compiled;
function modules() {
  return compiled ??= build({
    stdin: { resolveDir: new URL("../apps/web/src/",import.meta.url).pathname, loader:"ts", contents:
      ["team/pictures","state/use-images","state/use-storage-session","image-assets"]
        .map(path=>'export * from "./'+path+'";').join("\n")+'\nexport {render,dispose} from "react";' },
    footer:{js:"//# sourceURL=media-import-harness.mjs"}, bundle:true, write:false, format:"esm", platform:"node", jsx:"automatic",
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
const bytes=s=>new TextEncoder().encode(s).buffer;
const frame={bytes:Uint8Array.from([255,216,255,1]).buffer,mime:"image/jpeg",pixelWidth:2,pixelHeight:3};
const movie={bytes:bytes("0000ftypisom"),mime:"video/mp4",durationMs:42000};
const clip={hash:hash(movie.bytes),video:movie,posterHash:hash(frame.bytes),poster:frame,name:"demo.mp4",width:20,height:30};
const pictures=()=>new Map([[clip.posterHash,frame]]), videos=()=>new Map([[clip.hash,movie]]);
const asFile=raw=>new Blob([raw]);
async function board(){
  const {addImages}=await import("../apps/web/src/images.ts");return addImages({...empty(),title:"Videos"},[clip],{x:0,y:0});
}
test("X8-U00 picture-only import keeps routing, notices and size refusals",async t=>{
  const local=await harness(t,true),team=await harness(t);
  await local.drop([file("a")]);assert.deepEqual(local.messages,["Added 1 image."]);assert.equal(local.edits[0][0].objects[0].type,"image");
  await team.drop([file("b")]);assert.deepEqual(team.messages,["Adding b…",""]);assert.equal(team.writes.length,0);
  await team.drop([{...file("large"),size:20971521}]);assert.equal(team.messages.at(-1),"Could not add large: it is larger than 20 MiB.");
});
test("X8-U01 schema 16 validates every video field, canonical order and disjoint picture/video identities",async()=>{
  const rules=await import("../packages/board-rules/src/document.ts"),r=await import("../packages/board-rules/src/objects/registry.ts");
  const b=await board(),o=b.objects[0],patch=v=>({...b,objects:[{...o,...v}]});
  assert.equal(b.schemaVersion,16);assert.equal(r.isVideo(o),true);assert(r.isMedia(o));assert.equal(r.pictureOf(o),o.poster);
  assert.deepEqual(new Set(r.assetsOf(o)),new Set([o.asset,o.poster]));assert(!r.eligibleIdea(o));assert(r.keepsProportions(o));
  const keys="id generation type page group section asset poster pixelWidth pixelHeight durationMs name description x y width height order".split(" ");
  assert.deepEqual(Object.keys(JSON.parse(rules.canonical(b)).objects[0]),keys);
  for(const key of keys){const bad=structuredClone(b);delete bad.objects[0][key];assert.throws(()=>rules.validate(bad),key);}
  for(const [key,values] of Object.entries({asset:["A".repeat(64),""],poster:[o.asset,"invalid"],pixelWidth:[0,1921,.5],
    pixelHeight:[0,1921],durationMs:[0,86400001,.5],name:["","a".repeat(256),"\x1f","\u0085","\ud800"],description:["a".repeat(1001),"\udfff"],extra:[true]}))
    for(const value of values)assert.throws(()=>rules.validate(patch({[key]:value})),key);
  for(const n of [1,1920])rules.validate(patch({pixelWidth:n,pixelHeight:n}));for(const n of [1,86400000])rules.validate(patch({durationMs:n}));
  assert.throws(()=>rules.validate({...b,schemaVersion:14}));rules.validate(patch({name:"🎬".repeat(255),description:"🎬".repeat(1000)}));
  const {addImages}=await import("../apps/web/src/images.ts");assert.throws(()=>rules.validate(addImages(b,[{hash:o.asset,picture:frame,width:2,height:3}],{x:0,y:0})));
  for(const version of [13,14]){const old={...empty(),title:"Videos",schemaVersion:version};assert.deepEqual(rules.upgrade(old),{...old,schemaVersion:16});}
});
test("X8-U02 content routing uses exact picture signatures before MP4, QuickTime and bounded EBML headers",async()=>{
  const r=await import("../apps/web/src/image-assets.ts");
  for(const [raw,mime] of [["0000ftypisom","video/mp4"],["0000ftypqt  ","video/quicktime"]]){
    assert.equal(r.videoHeader(bytes(raw)),mime);assert(r.isVideoKind(r.assetKind(bytes(raw))));assert.equal(r.videoHeader(bytes(raw.slice(0,-1))),null);}
  for(const size of [[132],[1,0,0,0,0,0,0,4]]){
    const raw=[26,69,223,163,66,130,...size,119,101,98,109];
    assert.equal(r.videoHeader(Uint8Array.from(raw).buffer),"video/webm");assert.equal(r.videoHeader(Uint8Array.from(raw.slice(0,-1)).buffer),null);
    assert.equal(r.videoHeader(Uint8Array.from([...raw.slice(0,4),...Array(56).fill(0),...raw.slice(4)]).buffer),null);}
  assert.deepEqual(r.assetKind(bytes("RIFFftypWEBP")),{picture:"image/webp"});assert(r.isPictureKind(r.assetKind(frame.bytes)));
  for(const data of [bytes("GIF89a"),new ArrayBuffer(8),Uint8Array.from([137,80,78,71,13,10,26,10,...Array(17).fill(0)]).buffer])assert.equal(r.assetKind(data),null);
});
test("X8-U03 records validate hash, size, declared type and duration, first stored duration wins",async()=>{
  const r=await import("../apps/web/src/image-assets.ts"),key=r.assetKey(clip.hash),cache=new Map();
  assert(await r.validVideoRecord(key,movie));for(const patch of [{durationMs:0},{durationMs:.5},{durationMs:86400001},{note:""},{mime:"video/webm"},{bytes:new ArrayBuffer(52428801)},{bytes:frame.bytes}])
    assert.equal(await r.validVideoRecord(key,{...movie,...patch}),false);
  assert.equal(await r.validVideoRecord(r.assetKey("f".repeat(64)),movie),false);assert.equal(await r.validVideoRecord(key,frame),false);
  r.holdVideo(clip.hash,movie,cache);r.holdVideo(clip.hash,{...movie,durationMs:3},cache);assert.equal(cache.get(clip.hash),movie);
  const b=await board();b.objects.push({...b.objects[0],id:randomUUID()});assert.equal(r.pictureBytes(b,pictures()),frame.bytes.byteLength);assert.equal(r.videoBytes(b,cache),movie.bytes.byteLength);
});
test("X8-U04 poster, play mark, time, labels and notices use the drawn frame and file name",async()=>{
  const m=await import("../apps/web/src/video.ts"),a=await import("../apps/web/src/image-assets.ts"),i=await import("../apps/web/src/images.ts");
  assert.deepEqual(m.posterPixels(3840,2160),{pixelWidth:1920,pixelHeight:1080});assert.deepEqual(m.posterPixels(1,3000),{pixelWidth:1,pixelHeight:1920});
  assert.deepEqual([m.clockText(3725999),m.lengthText(499),m.lengthText(42500),m.currentText(99999,42000)],["1:02:05","0:01","0:43","0:42"]);
  const o=(await board()).objects[0], bitmap={width:2,height:3}, map=new Map([[o.poster,bitmap]]);
  a.tabPictures.set(o.poster,frame);try{assert(m.hasPlayMark(o,new Set(),map));assert.equal(m.videoFrame(o,map),bitmap);
    a.tabPictures.set(o.poster,{...frame,mime:"image/png"});assert.equal(m.videoFrame(o,map),undefined);assert(!m.hasPlayMark(o,new Set(),map));}finally{a.tabPictures.delete(o.poster);}
  for(const [im,vid,label,text] of [[1,0,"Image","1 image"],[0,1,"Video","1 video"],[0,2,"2 videos","2 videos"],[1,1,"2 items","2 items"]]){
    assert.equal(m.mediaLabel(im,vid),label);assert.equal(m.addedNotice(im,vid),"Added "+text+".");}
  assert.equal(m.videoName("\x00\ud800"),"Clipboard video");assert.equal(m.videoName("🎬".repeat(256)),"🎬".repeat(255));assert.equal(m.loadFailedNotice("a"),"Could not load a. Press play to try again.");
  const unnamed=[{name:"",video:true},{name:""}];assert.equal(i.fileNames(unnamed),"Clipboard video and Clipboard image");
  assert.equal(i.addingNotice(unnamed,25),"Adding Clipboard video and Clipboard image… 25%");assert.equal(i.refusalNotice([{...unnamed[0],reason:"bad"}]),"Could not add Clipboard video: bad.");
});
test("X8-U05 board files 1–3 preserve schema, bundle typed assets, reject missing, oversized and non-JPEG entries",async()=>{
  const f=await import("../apps/web/src/board-file.ts"),{canonical}=await import("../packages/board-rules/src/document.ts"),b=await board();
  const env=(n,payload)=>JSON.stringify({format:"nextphase-board",fileVersion:n,payload,sha256:hash(bytes(payload))});
  const raw=await f.writeBoardFile(b,undefined,pictures(),videos()),outer=JSON.parse(raw),bundle=JSON.parse(outer.payload);
  assert.equal(outer.fileVersion,3);assert.deepEqual((await f.readBoardBundle(asFile(raw))).board,b);assert.deepEqual(bundle.assets.map(e=>e.sha256),[clip.hash,clip.posterHash].sort());
  assert.deepEqual(Object.keys(bundle.assets.find(e=>e.sha256===clip.hash)),["sha256","mime","durationMs","base64"]);
  assert.deepEqual(await f.readBoardFile(asFile(env(1,canonical(b))),pictures(),videos()),b);
  const old={...empty(),title:"Videos",schemaVersion:14};for(const n of [1,2,3]){const payload=n===1?canonical(old):JSON.stringify({document:canonical(old),assets:[]});
    assert.deepEqual(await f.readBoardFile(asFile(env(n,payload))),old);}
  assert.equal(f.FILE_LIMIT,216*1048576);await assert.rejects(f.readBoardFile({size:f.FILE_LIMIT+1,arrayBuffer:()=>assert.fail()}),/216 MiB/);
  await assert.rejects(f.writeBoardFile(b,undefined,pictures(),new Map()),/a video is unavailable/);
  await assert.rejects(f.readBoardBundle(asFile(env(2,outer.payload))),/damaged/);
  for(const patch of [assets=>assets.pop(),assets=>assets.find(e=>e.durationMs).mime="video/webm",assets=>assets.find(e=>e.durationMs).durationMs=0]){
    const broken=structuredClone(bundle);patch(broken.assets);await assert.rejects(f.readBoardBundle(asFile(env(3,JSON.stringify(broken)))),/damaged/);}
  const gifBytes=gif(),key=hash(gifBytes),bad={...b,objects:b.objects.map(o=>({...o,poster:key}))};
  const assets=bundle.assets.map(e=>e.sha256===clip.posterHash?{...e,sha256:key,mime:"image/gif",base64:Buffer.from(gifBytes).toString("base64")}:e).sort((a,b)=>a.sha256.localeCompare(b.sha256));
  await assert.rejects(f.readBoardBundle(asFile(env(3,JSON.stringify({document:canonical(bad),assets})))),/damaged/);
  await assert.rejects(f.readBoardFile(asFile(env(1,canonical(b))),pictures(),new Map([[clip.hash,{...movie,bytes:{byteLength:104857601}}]])),/100 MiB/);
});
test("X8-U06 imports and clipboard budget videos by distinct asset and keep the hosted paste independent of video cache",async()=>{
  const i=await import("../apps/web/src/images.ts"),c=await import("../apps/web/src/clipboard.ts"),b=await board(),o=b.objects[0];
  assert.equal(i.importReason(b,[],clip,pictures(),videos()),"");
  const big={...clip,hash:"b".repeat(64),video:{...movie,bytes:{byteLength:104857600}}};
  assert.equal(i.importReason(b,[],big,pictures(),videos()),i.VIDEO_REASONS.bytes);assert.equal(i.importReason(b,[],big,pictures(),null),"");
  assert.equal(i.importReason(b,[],{...clip,posterHash:"a",poster:{...frame,bytes:{byteLength:52428800}}},pictures(),null),i.IMAGE_REASONS.bytes);
  const s=c.buildSnapshot(b,new Set([o.id]),[o]),view={centerX:0,centerY:0,width:100,height:100,zoom:1};
  assert.equal(c.buildPaste(b,s,view,pictures(),o.page,null).board.objects[1].asset,o.asset);
  assert.throws(()=>c.buildPaste(b,s,view,pictures(),o.page,new Map([[o.asset,{bytes:{byteLength:104857601}}]])),/100 MiB/);
});
test("X8-U07 media routing refuses unread oversize and rejected reads, counts a sniffed paste exactly once on either board",async t=>{
  const reasons=await import("../apps/web/src/images.ts");for(const local of [true,false]){
    const h=await harness(t,local);for(const [type,size,reason] of [
      ["image/png",52428801,local?reasons.IMAGE_REASONS.file:reasons.HOSTED_REASONS.too_large],["video/mp4",52428801,local?reasons.VIDEO_REASONS.file:reasons.HOSTED_REASONS.video_too_large],
      ["",52428801,local?reasons.VIDEO_REASONS.file:reasons.HOSTED_REASONS.video_too_large],["application/octet-stream",30*1048576,reasons.IMAGE_REASONS.type],
      ["image/png",30*1048576,local?reasons.IMAGE_REASONS.file:reasons.HOSTED_REASONS.too_large],["reject",100,reasons.IMAGE_REASONS.type]]){
      let count=0;await h.drop([{name:"test",size,type,arrayBuffer:async()=>{count++;if(type==="reject")throw Error();return new ArrayBuffer(size);}}]);
      assert.equal(count,size>52428800?0:1);assert.equal(h.messages.at(-1),"Could not add test: "+reason+".");}
    let reads=0;const f={...file("paste"),type:"",arrayBuffer:async()=>{reads++;return gif();}};
    await h.render().pasted([f],()=>assert.fail("object paste"));assert.equal(reads,1);assert.equal(h.edits.at(-1)[0].objects.length,1);
  }
});
test("X8-U08 preparing a clip checks seek, timeout, dimensions, duration, JPEG encoding and cleanup",async t=>{
  const {prepareVideo}=await import("../apps/web/src/video.ts");
  let mode="ok",timer,removed=0,options,el,revoked=0;
  t.mock.method(URL,"revokeObjectURL",()=>{revoked++;});
  replace(t,"setTimeout",(callback,ms)=>{assert.equal(ms,15000);timer=callback;return 1;});replace(t,"clearTimeout",noop);
  replace(t,"document",{createElement(tag){assert.equal(tag,"video");el={videoWidth:2,videoHeight:3,duration:42,
    set src(_){queueMicrotask(()=>{if(mode==="error")this.onerror();else if(mode==="timeout")timer();else this.onloadeddata();});},
    set currentTime(n){assert.equal(n,0);queueMicrotask(()=>mode==="seek-timeout"?timer():this.onseeked());},removeAttribute(name){assert.equal(name,"src");removed++;}};
    if(mode==="size")el.videoWidth=0;if(mode==="duration")el.duration=Infinity;return el;}});
  replace(t,"OffscreenCanvas",class{getContext(){return {drawImage:noop};}async convertToBlob(o){options=o;return new Blob([mode==="png"?gif():frame.bytes]);}});
  replace(t,"createImageBitmap",async()=>bitmap(mode==="wrong-size"?5:2,3));
  const v=await prepareVideo({name:"demo.mp4"},movie.bytes,movie.mime);assert.equal(v.hash,clip.hash);assert.equal(v.video.durationMs,42000);
  assert.deepEqual(options,{type:"image/jpeg",quality:.9});assert(el.muted&&el.playsInline&&el.preload==="auto");
  for(mode of ["error","timeout","seek-timeout","size","duration","png","wrong-size"])await assert.rejects(prepareVideo({name:""},movie.bytes,movie.mime),/cannot play/);
  assert.equal(removed,8);assert.equal(revoked,8);
});
test("X8-U09 one strict import writes missing keys, save and cleanup retain a poster until the last reference goes",async()=>{
  const a=await import("../apps/web/src/image-assets.ts"),b=await board(),records=new Map(),writes=[],pending=new Set();
  let transactions=0,abort=false;
  const request=value=>{const r={result:value};queueMicrotask(()=>r.onsuccess?.());return r;};
  const store={getKey:key=>request(records.has(key)?key:undefined),getAllKeys:()=>request([...records.keys()]),get:key=>request(records.get(key)),
    put(value,key){records.set(key,value);writes.push(key);},delete:key=>records.delete(key)};
  const db={transaction(name,mode,options){transactions++;assert.equal(name,"boards");assert.equal(mode,"readwrite");assert.deepEqual(options,{durability:"strict"});
    const original=new Map(records),tx={objectStore:()=>store};setImmediate(()=>{
      if(abort){records.clear();for(const [key,v] of original)records.set(key,v);tx.onabort();}else tx.oncomplete();});return tx;}};
  const put=r=>a.storeVideo(db,clip.hash,r,clip.posterHash,frame,pending);
  abort=true;await assert.rejects(put(movie));assert.equal(records.size,0);assert.equal(pending.size,0);
  abort=false;await put(movie);const count=writes.length;await put({...movie,durationMs:1000});assert.equal(writes.length,count);assert.equal(transactions,3);
  assert.equal(records.get(a.assetKey(clip.hash)).durationMs,42000);
  records.set("head",JSON.stringify({payload:JSON.stringify(b)}));records.delete(a.assetKey(clip.hash));
  a.writePictures(store,b,pictures(),videos());await new Promise(resolve=>setImmediate(resolve));
  assert.equal(records.get(a.assetKey(clip.hash)),movie);assert.equal(records.get(a.assetKey(clip.posterHash)),frame);
  const saved=writes.length;a.writePictures(store,b,pictures(),videos());await new Promise(resolve=>setImmediate(resolve));assert.equal(writes.length,saved);
  records.set("head",JSON.stringify({payload:JSON.stringify({...b,objects:[]})}));a.removeUnusedPictures(store);
  await new Promise(resolve=>setImmediate(resolve));assert.deepEqual([...records.keys()],["head"]);
});
test("X8-U10 hosted video uploads the first frame before the original and submits exactly one edit after both succeed",async t=>{
  const h=await harness(t);const pending=Promise.withResolvers(),calls=[];
  Object.assign(document,{createElement(){return {videoWidth:2,videoHeight:2,duration:2,removeAttribute(){},
    set src(_){queueMicrotask(()=>this.onloadeddata());},set currentTime(_){queueMicrotask(()=>this.onseeked());}};}});
  replace(t,"OffscreenCanvas",class{getContext(){return {drawImage(){}};}async convertToBlob(){return new Blob([frame.bytes]);}});
  const f={...file("",movie.bytes),type:"video/mp4"};h.hosted.pictures.upload=async key=>{calls.push(key);return {ok:true};};
  h.hosted.pictures.uploadVideo=async(key,body,progress)=>{assert.equal(body,f);calls.push(key);progress(1,2);return pending.promise;};
  const adding=h.drop([f]);assert.equal(h.messages[0],"Adding Clipboard image…");
  for(let i=0;i<200 && calls.length<2;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[clip.posterHash,clip.hash]);assert.deepEqual(h.edits,[]);assert(h.messages.includes("Adding Clipboard video… 0%"));
  pending.resolve("ok");await adding;assert.equal(h.edits.length,1);assert.deepEqual(h.writes,[]);assert.equal(h.edits[0][0].objects[0].name,"Clipboard video");
  h.hosted.pictures.upload=async()=>({ok:false,kind:"too_large"});h.hosted.pictures.uploadVideo=()=>assert.fail("uploaded refused first frame");
  await h.drop([f]);assert.equal(h.edits.length,1);assert.equal(h.messages.at(-1),"Could not add Clipboard video: the server did not accept it.");
});
test("X8-U11 download transport abort answers refused, stops progress and never caches partial bytes",async t=>{
  const h=await harness(t),transport=new h.m.BoardPictures(()=>randomUUID()),controller=new AbortController(),progress=[];
  let signal,cancelled=false;replace(t,"fetch",async(_,init)=>{signal=init.signal;return new Response(new ReadableStream({
    start(c){c.enqueue(new Uint8Array(2));},cancel(){cancelled=true;}
  }),{headers:{"Content-Length":"9","Content-Type":"video/mp4"}});});
  h.m.tabVideos.delete(clip.hash);
  const result=await transport.downloadVideo(clip.hash,(loaded,total)=>{progress.push([loaded,total]);if(loaded)controller.abort();},controller.signal);
  assert.deepEqual(result,{kind:"refused"});assert(signal.aborted);assert(cancelled);assert.deepEqual(progress,[[0,9],[2,9]]);
  assert(!h.m.tabVideos.has(clip.hash));
});
test("X8-U12 Save a copy stops on the first unavailable asset in object order and abandons an ended opening",async t=>{
  const m=await modules(),b=await board(),slots=[],calls=[],messages=[],requests=[];
  const last={...b.objects[0],id:randomUUID(),generation:randomUUID(),order:1,poster:"a".repeat(64),asset:"b".repeat(64)};
  b.objects.push(last);m.tabPictures.clear();m.tabVideos.clear();
  replace(t,"window",new EventTarget());replace(t,"createImageBitmap",async()=>bitmap(2,3));
  replace(t,"crypto",{randomUUID,subtle:{digest:async(_,data)=>Uint8Array.from(Buffer.from(hash(data),"hex")).buffer}});
  const hosted={subscribe:()=>noop,history:{},snapshot:{board:b},pictures:{
    async download(key){calls.push(key);return key===clip.posterHash?frame.bytes:null;},
    downloadVideo(key,progress,signal){calls.push(key);const gate=Promise.withResolvers();requests.push({...gate,signal});return gate.promise;}}};
  const props={hosted,model:{current:b},adapter:{current:null},revision:{current:0},pending:{current:{}},setMessage:s=>messages.push(s)};
  const render=()=>m.render(slots,()=>m.useStorageSession(props)).boardFiles;
  cleanup(t,()=>m.dispose(slots));let saving=render().saveCopy();
  async function waitFor(n){for(let i=0;i<200&&requests.length<n;i++)await new Promise(resolve=>setImmediate(resolve));assert.equal(requests.length,n);}
  await waitFor(1);assert(render().opening);requests[0].resolve({kind:"refused"});await saving;
  assert.deepEqual(calls,[clip.posterHash,clip.hash]);assert.equal(messages.at(-1),"Could not save a copy to file: a video is unavailable.");
  assert(!render().opening);calls.length=0;messages.length=0;
  saving=render().saveCopy();await waitFor(2);window.dispatchEvent(new Event("pagehide"));assert(requests[1].signal.aborted);
  requests[1].resolve({kind:"ok",blob:new Blob([movie.bytes],{type:movie.mime})});await saving;assert(!m.tabVideos.has(clip.hash));assert.deepEqual(messages,[]);
  saving=render().saveCopy();await waitFor(3);requests[2].resolve({kind:"ok",blob:new Blob([movie.bytes],{type:movie.mime})});await saving;
  assert.deepEqual(calls,[clip.hash,clip.hash,last.poster]);assert.equal(messages.at(-1),"Could not save a copy to file: a picture is unavailable.");
});
