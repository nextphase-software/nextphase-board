// SPDX-License-Identifier: Apache-2.0
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
import { Adapter } from "../../packages/board-sync/src/document-adapter.ts";
import { readBoard } from "../../packages/board-sync/src/codec.ts";
import { encode, decode } from "../../packages/board-sync/src/session.ts";
import { add, type BoardV14, type ImageItem } from "../../packages/board-rules/src/document.ts";

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
const rows = (name: string) => driver.rows(f.a, name);
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
  const vector = Y.encodeStateVector(c.adapter.doc); c.adapter.set(change(readBoard(c.adapter.doc)));
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
async function restoreVersion(id: string) {
  const {head}=await ok(request(root()+"/versions"));
  return ok(json(root()+"/versions/"+id+"/restore",{ requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation }));
}
async function restoreMissing() {
  const bytes=picture(), key=await hash(bytes);await ok(put(bytes),201);
  const c=await join();await edit(c,b=>addImage(add(b,"sticky",20,20),key));const {version}=await save();
  await edit(c,b=>({...b,objects:[b.objects[0]],retiredGenerations:[...b.retiredGenerations,b.objects[1].generation]}));
  await driver.control({board:f.a,roomSQL:[{sql:"DELETE FROM picture_parts"},{sql:"DELETE FROM pictures"}]});
  await restoreVersion(version.id);await refused(get(key),404,"not_found");return key;
}
check(431,"store, renew and privately read exact bytes",async()=>{
  const data=picture(), key=await hash(data), expected={asset:key,type:"image/gif",bytes:data.length};
  assert.deepEqual(await ok(put(data),201),expected);assert.deepEqual(await ok(put(data)),expected);
  assert.equal((await rows("pictures")).length,1);assert.equal((await rows("picture_parts")).length,1);
  const r=await get(key);assert.equal(r.status,200);assert.equal(r.headers.get("Content-Type"),"image/gif");
  assert.equal(r.headers.get("Content-Length"),String(data.length));assert.equal(r.headers.get("Cache-Control"),"private, max-age=31536000, immutable");
  assert.equal(r.headers.get("X-Content-Type-Options"),"nosniff");await assertPictureBytes(r, data);
});
check(432,"twenty 1 MiB parts and the streamed upload ceiling",async()=>{
  const data=picture(20*MiB), key=await hash(data);await ok(put(data),201);
  const parts=await rows("picture_parts");assert.equal(parts.length,20);assert(parts.every(p=>p.data.bytes===MiB));
  const r=await get(key);assert.equal(r.status,200);await assertPictureBytes(r, data);
  await refused(put(picture(20*MiB+1),"editor",key),413,"body_too_large");assert.equal((await rows("pictures")).length,1);
});
check(433,"path, role, body, header and hash refusals in order",async()=>{
  const data=picture(), key=await hash(data);await ok(put(data),201);
  await refused(request("/boards/bad/assets/"+key),404,"not_found");
  await refused(get("BAD"),404,"not_found");await refused(get(key,"outsider"),404,"not_found");
  await refused(put(data,"viewer"),403,"role_too_low","editor");await refused(put(picture(20*MiB+1),"viewer",key),403,"role_too_low","editor");
  assert.equal((await get(key,"viewer")).status,200);
  for(const b of [[],[65,66],[255,216,255,224,0,6],[255,216,255,218]])await refused(put(Uint8Array.from(b),"owner",key),400,"unsupported_picture");
  const png=new Uint8Array(24);png.set([137,80,78,71,13,10,26,10]);png.set([73,72,68,82,0,0,16,1,0,0,0,10],12);
  await refused(put(png,"owner",key),400,"picture_too_large");await refused(put(data,"owner","a".repeat(64)),400,"picture_hash_mismatch");
  await ok(request("/workspaces/"+f.workspace+"/members/"+f.people.editor.id,"owner","DELETE"));
  await refused(get(key,"editor"),404,"not_found");
  await lifecycle("move",0);await refused(get("BAD","owner"),404,"not_found");await refused(get(key,"owner"),404,"not_found");
});
check(434,"concurrent uploads cannot exceed the board limit",async()=>{
  for(const [n,tag] of [[20*MiB,1],[20*MiB,2],[10*MiB-1000,3]])await ok(put(picture(n,tag)),201);
  const pair=[picture(1000,4),picture(1000,5)], results=await Promise.all(pair.map(d=>put(d)));
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.deepEqual(await results.find(r=>r.status===409)!.json(),{error:{reason:"board_pictures_full"}});
  await ok(put(pair[results.findIndex(r=>r.status===201)]));
});
check(435,"missing/held image edits, broadcast, duplicate, and unrelated edits after restore",async()=>{
  const c=await join(), observer=await join("viewer"), data=picture(32,2), key=await hash(data);
  const change=update(c,b=>addImage(b,key));c.peer.send(change);assert.equal((await c.peer.next("refused")).reason,"asset_missing");
  assert.equal((await rows("edits")).length,0);await ok(put(data),201);c.peer.send({...change,requestId:crypto.randomUUID()});await c.peer.next("saved");
  Y.applyUpdate(observer.adapter.doc,decode((await observer.peer.next("update")).update));assert.equal(readBoard(observer.adapter.doc).objects.length,1);
  await edit(c,b=>addImage(b,key));
  // Use a fresh board to restore a missing image beside an independently movable sticky.
  f=await helper("removal-fixture");await restoreMissing();const after=await join();await edit(after,b=>({...b,objects:b.objects.map(o=>"text" in o?{...o,x:40}:o)}));
  await ok(json(root(),{title:"Renamed"},"PATCH"));
});
check(436,"capture retains live, historical and recently uploaded pictures",async()=>{
  const keys=[];for(let tag=0;tag<3;tag++)keys.push((await ok(put(picture(32,tag)),201)).asset);
  const c=await join();await edit(c,b=>addImage(addImage(b,keys[0]),keys[1]));await save();
  await edit(c,b=>({...b,objects:b.objects.slice(0,1),retiredGenerations:[...b.retiredGenerations,b.objects[1].generation]}));await save();
  for(const key of keys)assert.equal((await get(key)).status,200);
});
check(437,"verified restore before fencing and per-runner full-board backups",async()=>{
  const data=picture(MiB+1),key=await hash(data);await ok(put(data),201);const backup=await ok(operator("backup"));
  assert.equal(backup.tables.pictures.length,1);assert.equal(backup.tables.picture_parts.length,2);
  for(const change of [(t:any)=>t.picture_parts[1].part=2,(t:any)=>t.pictures.push(t.pictures[0])]){
    const bad=structuredClone(backup);change(bad.tables);const before=await driver.control({board:f.a,fences:true});
    await refused(operator("restore",bad),400,"bad_request");assert.deepEqual(await driver.control({board:f.a,fences:true}),before);
  }
  await ok(operator("restore",backup));await assertPictureBytes(await get(key), data);
  f=await helper("removal-fixture");await restoreMissing();await ok(operator("restore",await ok(operator("backup"))));
  f=await helper("removal-fixture");
  if(runner==="workerd"){await ok(put(picture(12*MiB+1)),201);await refused(operator("backup"),413,"backup_too_large");return;}
  await driver.control({backupLimit:96*MiB});
  try{
    for(const [n,tag] of [[20*MiB,1],[20*MiB,2],[10*MiB,3]])await ok(put(picture(n,tag)),201);
    const r=await operator("backup");assert.equal(r.status,200);const text=await r.text();
    assert(Buffer.byteLength(text)<=96*MiB);
    const restored=await driver.request("/operator"+root()+"/restore",{method:"POST",headers:{"Board-Operator-Key":context.operatorKey,"Content-Type":"application/json"},body:text});
    assert.equal(restored.status,200);
    for(const [n,tag] of [[20*MiB,1],[20*MiB,2],[10*MiB,3]]){
      const expected=picture(n,tag);await assertPictureBytes(await get(await hash(expected)), expected);
    }
  }finally{await driver.control({backupLimit:16*MiB});}
});
check(438,"new and restored version-8 rooms load as layout 9",async()=>{
  const b=await ok(operator("backup")), version=b.tables.meta.find((r:any)=>r.key==="storage_version");
  assert.equal(version.value,9);version.value=8;delete b.tables.pictures;delete b.tables.picture_parts;
  const snapshot = b.tables.snapshot_chunks;
  const doc = new Y.Doc();
  const yjs = snapshot.find((r:any) => r.kind === "yjs"), json = snapshot.find((r:any) => r.kind === "json");
  Y.applyUpdate(doc, decode(yjs.bytes)); doc.getMap("board").set("schemaVersion",14);
  yjs.bytes = encode(Y.encodeStateAsUpdate(doc)); doc.destroy();
  const board = JSON.parse(new TextDecoder().decode(decode(json.bytes))); board.schemaVersion = 14;
  json.bytes = encode(new TextEncoder().encode(JSON.stringify(board)));
  await ok(operator("restore",b));await ok(request(root()+"/export"));
  assert.equal((await rows("meta")).find(r=>r.key==="storage_version").value,9);assert.deepEqual(await rows("pictures"),[]);assert.deepEqual(await rows("picture_parts"),[]);
});
check(439,"Trash retains pictures until purge",async()=>{
  const data=picture(),key=await hash(data);await ok(put(data),201);await lifecycle("move",0);
  await refused(get(key),404,"not_found");await refused(put(data),404,"not_found");await lifecycle("restore",1);
  await assertPictureBytes(await get(key), data);await lifecycle("move",1);await lifecycle("delete",2);
  const inventory=await driver.control({board:f.a,inventory:true});assert.deepEqual(runner==="node"?inventory.files:inventory.tables,[]);
});
check(440,"restored image versions serve their bytes",async()=>{
  const data=picture(),key=await hash(data);await ok(put(data),201);const c=await join();await edit(c,b=>addImage(b,key));const {version}=await save();
  await edit(c,b=>({...b,objects:[],retiredGenerations:[...b.retiredGenerations,b.objects[0].generation]}));await restoreVersion(version.id);
  assert.equal((await ok(request(root()+"/export"))).objects[0].asset,key);await assertPictureBytes(await get(key), data);
});
check(441,"authenticated picture GET and preflight use the allowed origin",async()=>{
  const data=picture(),key=await hash(data);await ok(put(data),201);const path=asset(key);
  const pre=await driver.request(path,{method:"OPTIONS",headers:{Origin:context.origin,"Access-Control-Request-Method":"PUT","Access-Control-Request-Headers":"Content-Type"}});
  assert.equal(pre.status,204);assert.match(pre.headers.get("Access-Control-Allow-Methods")!,/PUT/);assert.match(pre.headers.get("Access-Control-Allow-Headers")!,/Content-Type/i);
  for(const origin of [context.origin,"https://other.example"]){
    const r=await request(path,"viewer","GET",undefined,origin);assert.equal(r.status,200);assert.equal(r.headers.get("Access-Control-Allow-Origin"),origin===context.origin?origin:null);
    await assertPictureBytes(r, data);
  }
});
