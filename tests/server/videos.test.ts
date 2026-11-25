// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
import { Adapter } from "../../packages/board-sync/src/document-adapter.ts";
import { readBoard } from "../../packages/board-sync/src/codec.ts";
import { encode, decode } from "../../packages/board-sync/src/session.ts";
import { add, type BoardV14, type VideoItem, type ImageItem } from "../../packages/board-rules/src/document.ts";

const context = inject<Context>("board"), runner = inject<string>("runner"), MiB = 1048576;
let driver: Driver, f: { a: string; workspace: string; people: Context["people"] };
const peers: Peer[] = [], docs: Y.Doc[] = [];
beforeAll(async () => { driver = await makeDriver(context); });
afterEach(async () => { for (const peer of peers.splice(0)) await peer.close(); for (const doc of docs.splice(0)) doc.destroy(); });
afterAll(async () => { await driver?.close(); });
async function helper(action: string, value: unknown = {}) {
  const response = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  assert.equal(response.status, 200); return response.json() as Promise<any>;
}
function check(id: number, title: string, run: () => Promise<void>) {
  test(`S${id} ${title}`, async () => {
    f = await helper("removal-fixture");
    try { await run(); console.log("PASS: S" + id + " " + title); }
    catch (error) { console.log("FAIL: S" + id + " " + title); throw error; }
  });
}
function picture(length = 32, tag = 1) {
  const data = new Uint8Array(length);
  data.set([71,73,70,56,57,97,2,0,3,0,tag]);
  return data;
}
async function hash(data: Uint8Array<ArrayBuffer>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), b => b.toString(16).padStart(2,"0")).join("");
}
async function assertPictureBytes(response: Response, expected: Uint8Array<ArrayBuffer>) {
  const actual = new Uint8Array(await response.arrayBuffer());
  assert.equal(actual.byteLength, expected.byteLength);
  assert.equal(await hash(actual), await hash(expected));
}
const root = () => "/boards/" + f.a;
function request(path: string, role = "editor", method = "GET", body?: BodyInit, origin = context.origin) {
  return driver.request(path, { method, body, headers: { Authorization: "Bearer " + f.people[role].token, Origin: origin,
    "Content-Type": typeof body === "string" ? "application/json" : "application/octet-stream" } });
}
const asset = (hash: string) => root() + "/assets/" + hash;
const get = (hash: string, role?: string) => request(asset(hash), role);
async function put(data: Uint8Array<ArrayBuffer>, role?: string, key?: string) { return request(asset(key ?? await hash(data)), role, "PUT", data); }
async function ok(response: Promise<Response>, status = 200) {
  const r = await response; assert.equal(r.status, status); return r.json() as Promise<any>;
}
async function refused(response: Promise<Response>, status: number, reason: string, needed?: string) {
  assert.deepEqual(await ok(response,status),{ error: { reason, ...(needed ? { needed } : {}) } });
}
const json = (path: string, body: unknown, method = "POST") => request(path, "owner", method, JSON.stringify(body));
// The generic driver enumerates every column. Project lengths before inventorying
// parts so that an inspection never pulls a board of media into the test runner.
async function rows(name: string) {
  if(name !== "picture_parts") return driver.rows(f.a,name);
  await driver.control({board:f.a,roomSQL:[{sql:"CREATE VIEW IF NOT EXISTS test_video_part_sizes AS SELECT hash, part, length(data) AS size FROM picture_parts"}]});
  try { return await driver.rows(f.a,"test_video_part_sizes"); }
  finally { await driver.control({board:f.a,roomSQL:[{sql:"DROP VIEW IF EXISTS test_video_part_sizes"}]}); }
}
const operator = (name: string, body?: unknown) => driver.request("/operator" + root() + "/" + name, {
  method: "POST", headers: { "Board-Operator-Key": context.operatorKey, "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});
const lifecycle = (action: string, expectedCycle: number) => ok(json(action === "move" ? root()+"/trash" :
  "/workspaces/"+f.workspace+"/trash/"+f.a+"/"+action,{ requestId:crypto.randomUUID(), expectedCycle }));
async function join(role = "editor") {
  const {ticket} = await ok(request(root()+"/join-tickets",role,"POST"),201);
  const peer = await driver.connect(root()+"/join?ticket="+ticket); peers.push(peer);
  const joined = await peer.next("joined"), adapter = new Adapter(); docs.push(adapter.doc);
  Y.applyUpdate(adapter.doc, decode(joined.update)); return { peer, joined, adapter };
}
type Client = Awaited<ReturnType<typeof join>>;
function update(c: Client, change: (board: BoardV14) => BoardV14) {
  const vector = Y.encodeStateVector(c.adapter.doc); c.adapter.set(change(readBoard(c.adapter.doc) as BoardV14));
  return { kind:"edit", requestId:crypto.randomUUID(), epoch:c.joined.epoch, restoreGeneration:c.joined.restoreGeneration,
    update:encode(Y.encodeStateAsUpdate(c.adapter.doc, vector)) };
}
function addImage(b: BoardV14, asset: string): BoardV14 {
  const o: ImageItem & {page:string} = { id:crypto.randomUUID(),generation:crypto.randomUUID(),type:"image",page:b.pages[0].id,
    group:null,section:null,description:"",order:b.objects.length,x:0,y:0,width:2,height:3,pixelWidth:2,pixelHeight:3,asset };
  return { ...b,objects:[...b.objects,o] };
}
async function edit(c:Client, change:(board:BoardV14)=>BoardV14) {
  c.peer.send(update(c,change)); await c.peer.next("saved");
}
const save = () => ok(json(root()+"/versions",{requestId:crypto.randomUUID(),name:"Saved",description:""}));
function clip(n = 64, tag = 1, brand = "isom") {
  const bytes = new Uint8Array(n).fill(tag);
  bytes.set(new TextEncoder().encode("ftyp"+brand),4); return bytes;
}
const jpeg = (tag=1) => Uint8Array.from([255,216,255,192,0,8,8,0,3,0,2,tag]);
function addVideo(board: BoardV14, asset: string, poster: string): BoardV14 {
  const object: VideoItem = {id:crypto.randomUUID(),generation:crypto.randomUUID(),type:"video",page:board.pages[0].id,
    group:null,section:null,asset,poster,pixelWidth:2,pixelHeight:3,durationMs:4000,name:"clip.mp4",description:"",
    x:0,y:0,width:20,height:30,order:board.objects.length};
  return {...board,objects:[...board.objects,object]};
}
const sleep = (ms:number) => new Promise<void>(r=>setTimeout(r,ms));
async function waitFor(check:()=>Promise<boolean>, limit=70000) {
  const end=Date.now()+limit;
  while(!await check()) {assert(Date.now()<end,"Timed out waiting for room storage");await sleep(100);}
}
type TestClip = {length:number; key:string; part:(offset:number)=>Uint8Array<ArrayBuffer>};
function generated(length:number,tag=1): TestClip {
  const first=clip(Math.min(length,MiB),tag),more=new Uint8Array(MiB).fill(tag);
  const part=(offset:number)=>offset===0?first:more.subarray(0,Math.min(MiB,length-offset));
  const h=createHash("sha256");for(let at=0;at<length;at+=MiB)h.update(part(at));
  return {length,key:h.digest("hex"),part};
}
function streamPut(data:TestClip,key=data.key) {
  let offset=0;const body=new ReadableStream<Uint8Array>({pull(c){if(offset>=data.length){c.close();return;}
    const chunk=data.part(offset);offset+=chunk.length;c.enqueue(chunk);
  }},{highWaterMark:0});
  return driver.request(asset(key),{method:"PUT",body,...(runner!=="workerd"?{duplex:"half"}:{}),
    headers:{Authorization:"Bearer "+f.people.editor.token,Origin:context.origin,"Content-Type":"application/octet-stream"}});
}
async function verifyStream(response:Response,data:TestClip) {
  assert.equal(response.status,200);assert.equal(response.headers.get("Content-Length"),String(data.length));
  const reader=response.body!.getReader(),h=createHash("sha256");let size=0;
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;h.update(value);}
  assert.equal(size,data.length);assert.equal(h.digest("hex"),data.key);
}
async function paced(input: Uint8Array<ArrayBuffer> | TestClip, key = "", existing=false) {
  const bytes:TestClip="part" in input?input:{length:input.length,key:await hash(input),part:at=>input.subarray(at,at+MiB)};
  const gate=Promise.withResolvers<void>(), controller=new AbortController();
  let sent=0, released=false;
  const body=new ReadableStream<Uint8Array>({async pull(stream){
    if(sent && !released) {await gate.promise;released=true;}
    if(controller.signal.aborted){stream.error(Error("aborted"));return;}
    if(sent===bytes.length){stream.close();return;}
    const end=Math.min(sent+MiB,bytes.length);stream.enqueue(bytes.part(sent));sent=end;
  }},{highWaterMark:0});
  const opts:RequestInit & {duplex?:"half"}={method:"PUT",body,signal:controller.signal,
    headers:{Authorization:"Bearer "+f.people.editor.token,Origin:context.origin,"Content-Type":"application/octet-stream"}};
  if(runner!=="workerd")opts.duplex="half";
  const reply=driver.request(asset(key||bytes.key),opts);void reply.catch(()=>{});
  try {
    if(existing){await waitFor(async()=>sent>0);await sleep(100);}
    else await waitFor(async()=>(await rows("picture_parts")).some(r=>r.hash.startsWith("upload:")));
  } catch(error){controller.abort();gate.resolve();throw error;}
  return {reply,finish:()=>gate.resolve(),abort(){controller.abort();gate.resolve();}};
}
check(443,"video-roundtrip and video-duplicate-renews",async()=>{
  for(const [data,type] of [[clip(),"video/mp4"],[clip(32,2,"qt  "),"video/quicktime"],
    [Uint8Array.from([26,69,223,163,66,130,132,119,101,98,109]),"video/webm"]] as const){
    const key=await hash(data), expected={asset:key,type,bytes:data.length};
    assert.deepEqual(await ok(put(data),201),expected);
    const stamp=async()=>(await rows("pictures")).find(r=>r.hash===key).uploaded_at;
    const before=await stamp(),parts=(await rows("picture_parts")).length; await sleep(5);
    assert.deepEqual(await ok(put(data)),expected);assert((await stamp())>before);assert.equal((await rows("picture_parts")).length,parts);
    const response=await get(key,"viewer");assert.equal(response.status,200);assert.equal(response.headers.get("Content-Type"),type);
    assert.equal(response.headers.get("Content-Length"),String(data.length));assert.equal(response.headers.get("Cache-Control"),"private, max-age=31536000, immutable");
    assert.equal(response.headers.get("X-Content-Type-Options"),"nosniff");await assertPictureBytes(response,data);
  }
});
check(444,"video-oversized and video-duplicate-oversized",async()=>{
  const bytes=generated(50*MiB),key=bytes.key;await ok(streamPut(bytes),201);
  assert.equal((await rows("picture_parts")).length,50);await verifyStream(await get(key),bytes);
  const stamp=(await rows("pictures"))[0].uploaded_at;
  const oversized=generated(50*MiB+1,2);for(const k of [oversized.key,key]) await refused(streamPut(oversized,k),413,"body_too_large");
  assert.equal((await rows("pictures"))[0].uploaded_at,stamp);
  assert.equal((await rows("pictures")).length,1);assert((await rows("picture_parts")).every(r=>r.hash===key));
});
check(445,"video-budgets-apart and video-concurrent-staging",async()=>{
  await ok(streamPut(generated(50*MiB)),201);await ok(streamPut(generated(50*MiB-1000,2)),201);
  const tail=await Promise.all([put(clip(1000,3)),put(clip(1000,4))]);assert.deepEqual(tail.map(r=>r.status).sort(),[201,409]);
  assert.deepEqual(await tail.find(r=>r.status===409)!.json(),{error:{reason:"board_videos_full"}});
  assert(!(await rows("picture_parts")).some(r=>r.hash.startsWith("upload:")));
  await refused(put(clip(32,8)),409,"board_videos_full");await ok(put(picture()),201);
  f=await helper("removal-fixture");for(const [n,tag] of [[20,1],[20,2],[10,3]])await ok(put(picture(n*MiB,tag)),201);
  await ok(put(clip()),201);await refused(put(picture()),409,"board_pictures_full");
  f=await helper("removal-fixture");await ok(streamPut(generated(50*MiB)),201);await ok(streamPut(generated(47*MiB,2)),201);
  const a=await paced(generated(2*MiB,3)),b=await paced(generated(2*MiB,4));
  a.finish();b.finish();const competing=await Promise.all([a.reply,b.reply]);assert.deepEqual(competing.map(r=>r.status).sort(),[201,409]);
  f=await helper("removal-fixture");const first=generated(2*MiB,5),owner=await paced(first),waiter=streamPut(first);
  owner.finish();await ok(owner.reply,201);await ok(waiter);
  const next=generated(2*MiB,6),failed=await paced(generated(2*MiB,7),next.key),waiting=await paced(next,next.key,true);
  waiting.finish();failed.finish();await refused(failed.reply,400,"picture_hash_mismatch");await refused(waiting.reply,503,"service_unavailable");
});
check(446,"video-hash-mismatch, video-duplicate-bad-body and video-duplicate-demoted",async()=>{
  const b=clip(2*MiB),key=await hash(b);await refused(put(b,"editor","a".repeat(64)),400,"picture_hash_mismatch");
  assert.deepEqual(await rows("picture_parts"),[]);await refused(put(new Uint8Array(100)),400,"unsupported_picture");
  await ok(put(b),201);const stamp=(await rows("pictures"))[0].uploaded_at;
  await refused(put(clip(),"editor",key),400,"picture_hash_mismatch");await refused(put(b,"viewer"),403,"role_too_low","editor");
  assert.equal((await get(key,"viewer")).status,200);await refused(get(key,"outsider"),404,"not_found");
  const slow=await paced(b,key,true);
  try{await ok(json("/workspaces/"+f.workspace+"/members/"+f.people.editor.id,{role:"viewer"},"PUT"));}finally{slow.finish();}
  await refused(slow.reply,403,"role_too_low","editor");assert.equal((await rows("pictures"))[0].uploaded_at,stamp);
  await ok(request("/workspaces/"+f.workspace+"/members/"+f.people.editor.id,"owner","DELETE"));await refused(get(key),404,"not_found");
  await lifecycle("move",0);await refused(get(key,"owner"),404,"not_found");
});
check(447,"video-asset-missing and video-slow-upload-edit",async()=>{
  const c=await join(),observer=await join("viewer"), b=clip(),key=await hash(b),frame=jpeg(),poster=await hash(frame);
  const change=update(c,board=>addVideo(board,key,poster));
  for(let step=0;step<2;step++){c.peer.send({...change,requestId:crypto.randomUUID()});
    assert.equal((await c.peer.next("refused")).reason,"asset_missing");assert.deepEqual(await rows("edits"),[]);
    if(!step)await ok(put(b),201);else await ok(put(frame),201);}
  c.peer.send({...change,requestId:crypto.randomUUID()});await c.peer.next("saved");
  Y.applyUpdate(observer.adapter.doc,decode((await observer.peer.next("update")).update));assert.equal(readBoard(observer.adapter.doc).objects[0].type,"video");
  await edit(c,board=>({...board,objects:board.objects.map(o=>({...o,x:30}))}));
  await edit(c,b=>add(b,"sticky",10,10));const slow=await paced(generated(50*MiB,9));
  try{await edit(c,board=>({...board,objects:board.objects.map(o=>o.type==="sticky"?{...o,x:50}:o)}));}finally{slow.finish();}
  await ok(slow.reply,201);
  const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10]);png.set([73,72,68,82],12);png[19]=2;png[23]=3;
  const other=(await ok(put(png),201)).asset;c.peer.send(update(c,board=>addVideo(board,key,other)));assert.equal((await c.peer.next("refused")).reason,"asset_missing");
});
check(448,"video-abort-cleanup and retained video versions",async()=>{
  const keys=[];for(const tag of [1,2,3])keys.push([(await ok(put(clip(64,tag)),201)).asset,(await ok(put(jpeg(tag)),201)).asset]);
  const c=await join();await edit(c,b=>addVideo(addVideo(b,keys[0][0],keys[0][1]),keys[1][0],keys[1][1]));await save();
  await edit(c,b=>({...b,objects:b.objects.slice(0,1),retiredGenerations:[...b.retiredGenerations,b.objects[1].generation]}));await save();
  for(const key of keys.flat())assert.equal((await get(key)).status,200);
  const b=clip(3*MiB), key=await hash(b), slow=await paced(b);slow.abort();await slow.reply.catch(()=>null);
  await waitFor(async()=>!(await rows("picture_parts")).some(r=>r.hash.startsWith("upload:")));await save();
  assert(!(await rows("picture_parts")).some(r=>r.hash===key||r.hash.startsWith("upload:")));await refused(get(key),404,"not_found");
});
check(449,"video-backup-node and video-backup-workers-early",async()=>{
  const data=clip(MiB+1),key=await hash(data);await ok(put(data),201);
  const backup=await ok(operator("backup"));assert.equal(backup.tables.picture_parts.length,2);
  await ok(operator("restore",backup));await assertPictureBytes(await get(key),data);
  f=await helper("removal-fixture");
  if(runner==="workerd"){await ok(streamPut(generated(12*MiB+1)),201);await refused(operator("backup"),413,"backup_too_large");return;}
  await driver.control({backupLimit:224*MiB});
  try{
    const ids=[];for(const [n,tag] of [[50,1],[50,2],[20,3],[20,4],[10,5]])ids.push((await ok((n===50?streamPut(generated(n*MiB,tag)):put(picture(n*MiB,tag))),201)).asset);
    const r=await operator("backup");assert.equal(r.status,200);const raw=await r.text();assert(Buffer.byteLength(raw)<=224*MiB);
    const result=await driver.request("/operator"+root()+"/restore",{method:"POST",headers:{"Board-Operator-Key":context.operatorKey,"Content-Type":"application/json"},body:raw});
    assert.equal(result.status,200);for(const key of ids)assert.equal(await hash(new Uint8Array(await (await get(key)).arrayBuffer())),key);
  }finally{await driver.control({backupLimit:16*MiB});}
});
check(450,"video-trash-during-upload and video-erase",async()=>{
  const b=clip(),key=await hash(b);await ok(put(b),201);const slow=await paced(clip(3*MiB));
  try{await lifecycle("move",0);}finally{slow.finish();}await refused(slow.reply,404,"not_found");
  await refused(get(key,"owner"),404,"not_found");await refused(put(b,"owner"),404,"not_found");await lifecycle("restore",1);
  await assertPictureBytes(await get(key),b);await lifecycle("move",1);await lifecycle("delete",2);
  const i=await driver.control({board:f.a,inventory:true});assert.deepEqual(runner==="node"?i.files:i.tables,[]);
});
check(451,"board import and team templates refuse valid video objects",async()=>{
  const {empty,validate}=await import("../../packages/board-rules/src/document.ts");
  const b=addVideo({...empty(),title:"Clip"},"a".repeat(64),"b".repeat(64));validate(b);
  await refused(json("/workspaces/"+f.workspace+"/boards",{title:b.title,document:b}),400,"images_not_supported");
  const objects=b.objects.map(({page,generation,order,...rest})=>rest);
  await refused(json("/workspaces/"+f.workspace+"/templates",{sourceBoard:f.a,name:"Clips",description:"",objects}),400,"bad_request");
});
check(452,"unchanged picture upload, read and held-image edit",async()=>{
  const c=await join(),b=picture(),key=await hash(b);
  const msg=update(c,board=>addImage(board,key));c.peer.send(msg);assert.equal((await c.peer.next("refused")).reason,"asset_missing");
  assert.deepEqual(await ok(put(b),201),{asset:key,type:"image/gif",bytes:b.length});await assertPictureBytes(await get(key),b);
  c.peer.send({...msg,requestId:crypto.randomUUID()});await c.peer.next("saved");assert.equal((await rows("edits")).length,1);
});
