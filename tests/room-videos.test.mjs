// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import * as Y from "yjs";

const MiB = 1048576, hash = bytes => createHash("sha256").update(bytes).digest("hex");
const mp4 = (size = 32, tag = 1) => { const b = Buffer.alloc(size, tag); b.write("ftypisom",4); return b; };
const jpeg = Buffer.from([255,216,255,192,0,8,8,0,3,0,2,0]);
const gif = Buffer.from([71,73,70,56,57,97,2,0,3,0]);
const stream = chunks => new ReadableStream({start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); }});
function pipe() {
  let source, cancelled = false;
  const body = new ReadableStream({start(c) { source=c; }, cancel(){ cancelled=true; }}, {highWaterMark:0});
  return {body, send:chunk=>source.enqueue(chunk), finish:()=>source.close(), get cancelled(){ return cancelled; }};
}
async function until(check) {
  for(let i=0;i<200;i++){ if(check()) return; await new Promise(resolve=>setImmediate(resolve)); }
  assert.fail("Room operation did not reach the expected state");
}
async function fixture(t) {
  const { Room } = await import("../packages/board-room/src/room.ts"), { NodeStorage } = await import("../apps/server/src/node-storage.ts");
  const db = new NodeStorage(":memory:"), id=randomUUID(), timers=new Set(), hashed=[];
  let time=1794000000000, fence=0, aborted=0;
  const env={storage:db, now:()=>time, access:{ board:async()=>({title:"Videos",createdAt:new Date(time).toISOString()}),
    role:async()=>"editor", changes:async()=>({changes:[],latest:0,lowestKept:1}) },
    lifecycle:{lifecycle:async()=>({state:"active",generation:0})}, connections:()=>[], randomId:randomUUID, randomTicket:randomUUID,
    schedule:async()=>{}, fence:async()=>fence, raiseFence:async(min=0)=>fence=Math.max(fence,min)+1,
    backupLimit:224*MiB, hash:async b=>hash(b), timer(ms,cb){const e={at:time+ms,cb};timers.add(e);return ()=>timers.delete(e);},
    hasher(){const h=createHash("sha256");return {async update(b){hashed.push(b.length);h.update(b);},async hex(){return h.digest("hex");},abort(){aborted++;}};}};
  const room=new Room(id,env), person={id:randomUUID(),email:"editor@example.test",expiresAt:Number.MAX_SAFE_INTEGER};
  t.after(()=>{room.doc.destroy();db.close();});await room.load();
  return {room,person,env,db,timers,hashed,get aborted(){return aborted;},
    tick(ms){time+=ms;for(const e of [...timers].sort((a,b)=>a.at-b.at)) if(e.at<=time && timers.delete(e))e.cb();},
    put:(b,body=stream([b]),key=hash(b))=>room.storeVideo(person,key,"video/mp4",body),
    parts:()=>db.all("SELECT hash, part, length(data) AS size FROM picture_parts ORDER BY hash, part"),
    save:()=>room.saveVersion(person,{requestId:randomUUID(),name:"Saved",description:""})};
}
function video(board, bytes, frame=jpeg) {
  return {id:randomUUID(),generation:randomUUID(),type:"video",page:board.pages[0].id,group:null,section:null,asset:hash(bytes),
    poster:hash(frame),pixelWidth:2,pixelHeight:3,durationMs:4000,name:"clip.mp4",description:"",x:0,y:0,width:2,height:3,order:board.objects.length};
}
async function evaluate(room,board) {
  const {evaluate}=await import("../packages/board-room/src/edits.ts"),{Adapter}=await import("../packages/board-sync/src/document-adapter.ts");
  const a=new Adapter();try{Y.applyUpdate(a.doc,Y.encodeStateAsUpdate(room.doc));const v=Y.encodeStateVector(a.doc);
    a.set(board);return evaluate(room.doc,room.board,Y.encodeStateAsUpdate(a.doc,v),room.env.storage);}finally{a.destroy();}
}
test("X8-U31 split headers replay in order, picture signature wins and route never aggregates a video",async t=>{
  const {pictureSignature,videoType}=await import("../packages/board-room/src/pictures.ts");
  const {head}=await import("../apps/server/src/routes/common.ts"),{pictureRoutes}=await import("../apps/server/src/routes/pictures.ts");
  const f=await fixture(t), bytes=mp4(2*MiB+7), key=hash(bytes);
  const split=()=>stream([bytes.subarray(0,5),bytes.subarray(5,11),bytes.subarray(11,90),bytes.subarray(90)]);
  const request={body:split(),arrayBuffer(){assert.fail("video body aggregated");}};
  const replay=await head({req:{raw:request}},64);assert.deepEqual(Buffer.from(replay.head),bytes.subarray(0,64));
  assert.deepEqual(Buffer.from(await new Response(replay.body).arrayBuffer()),bytes);
  assert.equal(videoType(bytes),"video/mp4");assert.equal(videoType(Buffer.from("0000ftypqt  ")),"video/quicktime");
  const webp=Buffer.from("RIFFftypWEBP");assert.equal(pictureSignature(webp),"image/webp");
  for(const size of [[132],[1,0,0,0,0,0,0,4]])assert.equal(videoType(Buffer.from([26,69,223,163,66,130,...size,119,101,98,109])),"video/webm");
  let put;pictureRoutes({put(_,cb){put=cb;},get(){}},{db:{role:async()=>"editor"},room:()=>f.room});
  const context={req:{raw:{...request,body:split()},param:name=>name==="board"?f.room.boardId:key},get:()=>f.person,json:(body,status)=>({body,status})};
  assert.deepEqual(await put(context),{status:201,body:{asset:key,type:"video/mp4",bytes:bytes.length}});
});
test("X8-U32 staging writes each full part as received, final transaction publishes the row last and reads pull one part",async t=>{
  const f=await fixture(t), b=mp4(2*MiB+12), p=pipe(), tx=[], original=f.db.transaction.bind(f.db), exec=f.db.exec.bind(f.db);
  let current;
  f.db.transaction=op=>original(()=>{const last=current;current=[];tx.push(current);try{return op();}finally{current=last;}});
  f.db.exec=(sql,...args)=>{current?.push(sql);return exec(sql,...args);};
  const stored=f.put(b,p.body);p.send(b.subarray(0,MiB));await until(()=>f.parts().length===1);
  assert.deepEqual(f.hashed,[MiB]);assert.match(f.parts()[0].hash,/^upload:/);assert.equal(await f.room.readVideo(f.person,hash(b)),null);
  assert.deepEqual((await f.room.backup()).tables.picture_parts,[]); await f.save();assert.equal(f.parts().length,1);
  p.send(b.subarray(MiB));p.finish();assert.deepEqual(await stored,{result:"created",type:"video/mp4",bytes:b.length});
  assert.equal(tx.filter(g=>g.some(sql=>sql.includes("UPDATE picture_parts SET hash"))&&g.at(-1).startsWith("INSERT INTO pictures")).length,1);
  assert.deepEqual(f.parts().map(p=>p.size),[MiB,MiB,12]);assert.equal(await f.room.readPicture(f.person,hash(b)),null);
  const all=f.db.all.bind(f.db);let pulls=0;f.db.all=(sql,...args)=>{if(sql.startsWith("SELECT data FROM picture_parts"))pulls++;return all(sql,...args);};
  const video=await f.room.readVideo(f.person,hash(b));assert.equal(pulls,0);const reader=video.body.getReader(),h=createHash("sha256");
  for(const size of [MiB,MiB,12]) {const {value}=await reader.read();assert.equal(value.length,size);h.update(value);}
  assert.equal((await reader.read()).done,true);assert.equal(h.digest("hex"),hash(b));assert.equal(pulls,3);
  const interrupted=(await f.room.readVideo(f.person,hash(b))).body.getReader();await interrupted.read();
  f.db.exec("DELETE FROM picture_parts WHERE hash=? AND part=1",hash(b));await assert.rejects(interrupted.read());
});
test("X8-U33 duplicate draining hashes every byte, concurrent waiter shares owner and bad bodies never renew",async t=>{
  const f=await fixture(t), b=mp4(MiB+5), p=pipe(), owner=f.put(b,p.body);
  p.send(b.subarray(0,MiB));await until(()=>f.parts().length===1);
  const other=f.put(b);await until(()=>f.hashed.length>=2);assert.equal(f.parts().length,1);
  p.send(b.subarray(MiB));p.finish();assert.deepEqual((await Promise.all([owner,other])).map(r=>r.result),["created","exists"]);
  const uploaded=()=>f.db.all("SELECT uploaded_at FROM pictures")[0].uploaded_at, before=uploaded();f.tick(50);
  await assert.rejects(f.put(mp4(50),undefined,hash(b)),/picture_hash_mismatch/);assert.equal(uploaded(),before);
  assert.equal((await f.put(b)).result,"exists");assert.equal(uploaded(),before+50);
  const bad=mp4(MiB+4,8), q=pipe(), failed=f.put(bad,q.body);q.send(bad.subarray(0,MiB));await until(()=>f.parts().some(p=>p.hash.startsWith("upload:")));
  const waiting=f.put(bad);await until(()=>f.hashed.at(-1)===bad.length);
  const both=Promise.allSettled([failed,waiting]);q.finish();const [a,w]=await both;
  assert.match(a.reason.message,/picture_hash_mismatch/);assert.equal(w.reason.status,503);assert(!f.parts().some(p=>p.hash.startsWith("upload:")));
});
test("X8-U34 idle deadline resets on a chunk, aborts the writer and reader, and housekeeping removes only abandoned staging",async t=>{
  const f=await fixture(t),p=pipe(),b=mp4(MiB+4),result=f.put(b,p.body);await until(()=>f.timers.size===1);
  f.tick(59999);p.send(b.subarray(0,MiB));await until(()=>f.parts().length===1);
  f.db.exec("INSERT INTO picture_parts VALUES ('upload:abandoned',0,?)",new Uint8Array([0]));await f.save();
  assert.equal(f.parts().length,1);assert.notEqual(f.parts()[0].hash,"upload:abandoned");
  f.tick(59999);assert.equal(p.cancelled,false);
  const done=assert.rejects(result,e=>e.status===503);f.tick(1);await done;
  assert(p.cancelled);assert.equal(f.aborted,1);assert.equal(f.timers.size,0);assert.deepEqual(f.parts(),[]);
});
test("X8-U35 owners, waiters and held duplicates cancel with the first fence outcome",async t=>{
  for(const [mode,status] of [["trash",404],["ready",503],["backup",503],["discard",503],["lock",503]]){
    const f=await fixture(t),held=mp4(),b=mp4(MiB+5,2);await f.put(held);
    const backup=await f.room.backup(),streams=[pipe(),pipe(),pipe()];
    const results=Promise.allSettled([f.put(b,streams[0].body),f.put(b,streams[1].body),f.put(held,streams[2].body)]);
    streams[0].send(b.subarray(0,MiB));await until(()=>f.parts().length===2 && f.timers.size===3);
    if(mode==="trash"||mode==="ready"){
      const row={state:mode==="ready"?"active":"trashed",generation:1};f.env.lifecycle.lifecycle=async()=>row;
      await f.room.fenceLifecycle(row,mode==="ready");
    }
    else if(mode==="backup")await f.room.restore(backup);else if(mode==="lock")await f.room.lock();else await f.room.discardLifecycle();
    for(const r of await results){assert.equal(r.status,"rejected",mode);assert.equal(r.reason.status,status,mode);}
    assert(streams.every(p=>p.cancelled));assert.equal(f.timers.size,0);assert(!f.parts().some(p=>p.hash.startsWith("upload:")));
  }
});
test("X8-U36 file ceiling, separate budgets and concurrent staging at the board limit",async t=>{
  const f=await fixture(t),a=mp4(50*MiB,1), b=mp4(50*MiB-1000,2);
  assert.equal((await f.put(a)).result,"created");
  const tooBig=()=>stream([a,Buffer.from([1])]);for(const key of [hash(a),"f".repeat(64)])
    await assert.rejects(f.put(a,tooBig(),key),e=>e.status===413);
  assert.equal((await f.put(b)).result,"created");
  const tail=await Promise.all([f.put(mp4(1000,3)),f.put(mp4(1000,4))]);assert.deepEqual(tail.map(r=>r.result).sort(),["created","full"]);
  assert.equal((await f.put(mp4(32,5))).result,"full");assert(!f.parts().some(p=>p.hash.startsWith("upload:")));
  assert.equal(await f.room.storePicture(f.person,hash(gif),gif,"image/gif",2,3),"created");
  const g=await fixture(t);for(const [n,tag] of [[20,1],[20,2],[10,3]]){const data=Buffer.alloc(n*MiB,tag);gif.copy(data);
    assert.equal(await g.room.storePicture(g.person,hash(data),data,"image/gif",2,3),"created");}
  assert.equal((await g.put(mp4())).result,"created");assert.equal(await g.room.storePicture(g.person,hash(gif),gif,"image/gif",2,3),"full");
});
test("X8-U37 backups verify streamed video hashes and row types before fencing or replacing storage",async t=>{
  const f=await fixture(t),b=mp4(MiB+27);await f.put(b);await f.room.storePicture(f.person,hash(gif),gif,"image/gif",2,3);
  const saved=await f.room.backup();f.hashed.length=0;await f.room.restore(saved);assert.deepEqual(f.hashed,[MiB,27]);
  const row=()=>f.db.all("SELECT * FROM pictures ORDER BY hash"),before=row(),generation=f.room.generation;
  for(const corrupt of [tables=>tables.pictures.find(x=>x.hash===hash(b)).type="video/webm",
    tables=>tables.pictures.find(x=>x.hash===hash(gif)).type="image/jpeg",tables=>tables.picture_parts.find(x=>x.part===1).data=Buffer.alloc(27).toString("base64")]){
    const bad=structuredClone(saved);corrupt(bad.tables);await assert.rejects(f.room.restore(bad),/bad_request/);
    assert.deepEqual(row(),before);assert.equal(f.room.generation,generation);
  }
  f.env.backupLimit=MiB;await assert.rejects(f.room.backup(),/backup_too_large/);
});
test("X8-U38 typed edit gate checks new and changed media, skips unchanged references, retains live and historical hashes",async t=>{
  const f=await fixture(t),b=mp4(),v=video(f.room.board,b),next={...f.room.board,objects:[v]};
  assert.equal((await evaluate(f.room,next)).reason,"asset_missing");await f.put(b);
  assert.equal((await evaluate(f.room,next)).reason,"asset_missing");await f.room.storePicture(f.person,hash(gif),gif,"image/gif",2,3);
  assert.equal((await evaluate(f.room,{...next,objects:[{...v,poster:hash(gif)}]})).reason,"asset_missing");
  await f.room.storePicture(f.person,hash(jpeg),jpeg,"image/jpeg",2,3);
  const edit=await evaluate(f.room,next);assert.equal(edit.kind,"complete");Y.applyUpdate(f.room.doc,edit.update);f.room.board=edit.board;edit.doc.destroy();
  await f.save();f.tick(86400001);await f.save();
  for(const hash of [v.poster,v.asset])assert(f.parts().some(p=>p.hash===hash));
  for(const patch of [{asset:hash(gif)},{poster:hash(gif)},{asset:"a".repeat(64)},{poster:"b".repeat(64)}])
    assert.equal((await evaluate(f.room,{...next,objects:[{...v,...patch}]})).reason,"asset_missing");
  assert(!f.parts().some(p=>p.hash===hash(gif)));
  const {cleanPictures}=await import("../packages/board-room/src/pictures.ts");
  cleanPictures(f.db,{...next,objects:[]},f.env.now());assert.equal(f.parts().length,2);
  f.db.exec("DELETE FROM picture_parts");f.db.exec("DELETE FROM pictures");
  const moved=await evaluate(f.room,{...next,objects:[{...v,x:30}]});assert.equal(moved.kind,"complete");moved.doc.destroy();
});
test("X8-U39 exact codec ranges, live schema, schema-only upgrade and per-type adapter keys",async t=>{
  const f=await fixture(t),{readBoard,readLiveBoard}=await import("../packages/board-sync/src/codec.ts"),
    {Adapter}=await import("../packages/board-sync/src/document-adapter.ts"),{storedBoardUpdate,version13Board,withoutPages}=await import("./import-fixture.mjs");
  const a=new Adapter();t.after(()=>a.destroy());
  for(const version of [10,11,12,13,14,15]){
    const b={...f.room.board,schemaVersion:version},doc=new Y.Doc();
    try {Y.applyUpdate(doc,storedBoardUpdate(version<13?withoutPages(b):b,version<13));assert.equal(readBoard(doc).schemaVersion,version);
      if(version!==15)assert.throws(()=>readLiveBoard(doc));else assert.equal(readLiveBoard(doc).schemaVersion,15);
    }finally{doc.destroy();}
  }
  const legacy=new Y.Doc();try{Y.applyUpdate(legacy,storedBoardUpdate(version13Board(f.room.board),true));
    assert.equal(readBoard(legacy,true).schemaVersion,13);assert.throws(()=>readBoard(legacy));}finally{legacy.destroy();}
  const v=video(f.room.board,mp4());a.set({...f.room.board,objects:[v]});assert.deepEqual(readLiveBoard(a.doc).objects,[v]);
  const {poster,durationMs,name,...rest}=v;a.set({...f.room.board,objects:[{...rest,type:"image"}]});
  const map=a.doc.getMap("objects").get(v.id);for(const key of ["poster","durationMs","name"])assert.equal(map.has(key),false);
  assert.equal(a.doc.getMap("board").get("pageMap").get(v.page).get("name"),"Page 1");
});
test("X8-U40 Worker forwards the request stream and both fixed-length pipes preserve and cancel its parts",async t=>{
  const {workerRuntime}=await import("../apps/server/src/worker-runtime.ts"),{WorkerRoom}=await import("../apps/server/src/worker-room.ts");
  const f=await fixture(t),endpoint=new WorkerRoom({},{});endpoint.room=f.room;
  const lengths=[],original=globalThis.FixedLengthStream;
  globalThis.FixedLengthStream=class extends TransformStream{
    constructor(expected){let count=0;super({transform(chunk,c){count+=chunk.length;if(count>expected)throw Error("long");c.enqueue(chunk);},
      flush(){if(count!==expected)throw Error("short");}});lengths.push(expected);}
  };t.after(()=>{if(original)globalThis.FixedLengthStream=original;else delete globalThis.FixedLengthStream;});
  const data=mp4(2*MiB+4),body=stream([data.subarray(0,MiB),data.subarray(MiB)]);
  const binding={idFromName:id=>id,get:()=>({fetch:async(url,init)=>{
    if(url.endsWith("/video-store"))assert.equal(init.body,body);
    const req=new Request(url,{...init,...(init.body?{duplex:"half"}:{})});
    if(url.endsWith("/video-store"))for(const method of ["arrayBuffer","bytes","json","text"])req[method]=()=>assert.fail(method+" on upload");
    return endpoint.fetch(req);
  }})};
  const client=workerRuntime({ROOMS:binding,SUPABASE_SERVICE_KEY:"synthetic",JWKS:'{"keys":[]}',SUPABASE_URL:"https://board.example"}).room(f.room.boardId);
  assert.equal((await client.storeVideo(f.person,hash(data),"video/mp4",body)).result,"created");
  const response=await client.readVideo(f.person,hash(data));assert.equal(response.bytes,data.length);assert.deepEqual(lengths,[data.length,data.length]);
  const digest=createHash("sha256");for await(const part of response.body)digest.update(part);assert.equal(digest.digest("hex"),hash(data));
  const interrupted=await client.readVideo(f.person,hash(data));await interrupted.body.cancel();
});
test("X8-U41 Node's default backup fits a small board at both media limits and restores each video part",async t=>{
  const f=await fixture(t),ids=[];
  for(const [n,tag] of [[50,1],[50,2],[20,3],[20,4],[10,5]]){
    const data=mp4(n*MiB,tag);
    if(n===50){assert.equal((await f.put(data)).result,"created");ids.push(hash(data));}
    else {gif.copy(data);assert.equal(await f.room.storePicture(f.person,hash(data),data,"image/gif",2,3),"created");}
  }
  const backup=await f.room.backup(),length=Buffer.byteLength(JSON.stringify(backup));
  assert(length>200*MiB&&length<=224*MiB);t.diagnostic("full backup bytes "+length);
  await f.room.restore(backup);assert.equal(f.parts().length,150);
  for(const key of ids){const digest=createHash("sha256");for await(const part of (await f.room.readVideo(f.person,key)).body)digest.update(part);
    assert.equal(digest.digest("hex"),key);}
});
