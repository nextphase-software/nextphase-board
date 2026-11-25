// SPDX-License-Identifier: Apache-2.0
// 0009-W3 server checks S407–S410 on both runners. Subjects load dynamically
// inside each check, so a missing feature fails its check by name.
import { test, beforeAll, afterAll, afterEach, inject } from "vitest";
import assert from "node:assert/strict";
import { storedBoardUpdate, withoutPages } from "../import-fixture.mjs";
import * as Y from "yjs";
import { makeDriver } from "board-test-driver";
import type { Context, Driver, Peer } from "./driver-types.ts";
const context = inject<Context>("board"), runner = inject<string>("runner");
let driver: Driver, f: any, pass = 0, fail = 0;
const peers: Peer[] = [], docs: Y.Doc[] = [];
beforeAll(async () => { driver = await makeDriver(context); });
afterEach(async () => { for (const p of peers.splice(0)) await p.close(); for (const doc of docs.splice(0)) doc.destroy(); });
afterAll(async () => { await driver.close(); console.log("SUMMARY-DRAWING-LAYOUT " + JSON.stringify({ runner, checks: pass + fail, pass, fail })); });
const modules = async () => ({
  rules: await import("../../packages/board-rules/src/document.ts"),
  tape: await import("../../apps/web/src/tape.ts"),
  registry: await import("../../packages/board-rules/src/objects/registry.ts"),
  adapter: await import("../../packages/board-sync/src/document-adapter.ts"),
  codec: await import("../../packages/board-sync/src/codec.ts"),
  session: await import("../../packages/board-sync/src/session.ts"),
});
async function helper(action: string, value: unknown = {}): Promise<any> {
  const r = await fetch(context.helperUrl + "/" + action, { method: "POST", body: JSON.stringify(value) });
  assert.equal(r.status, 200, await r.clone().text()); return r.json();
}
async function req(path: string, name = "owner", method = "GET", body?: unknown) {
  return driver.request(path, { method, headers: { Authorization: "Bearer " + f.people[name].token, Origin: context.origin, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function ok(path: string, name = "owner", method = "GET", body?: unknown, status = 200): Promise<any> {
  const r = await req(path, name, method, body); assert.equal(r.status, status, await r.clone().text()); return status === 204 ? null : r.json();
}
const exported = async (board = f.a) => JSON.parse(await (await req(`/boards/${board}/export`)).text());
const rows = (table: string, board = f.a) => driver.rows(board, table);
const versions = (board = f.a) => ok(`/boards/${board}/versions`);
const sql = (items: { sql: string; bindings?: unknown[] }[], board = f.a) => driver.control({ board, roomSQL: items });
const hex = (bytes: Uint8Array) => "x'" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") + "'";
async function sha256(bytes: Uint8Array) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join(""); }
async function until<T>(read: () => T | Promise<T>, predicate = (v: T) => !!v): Promise<T> {
  const end = Date.now() + 10000; let result: T;
  do { result = await read(); if (predicate(result)) return result; await new Promise((r) => setTimeout(r, 10)); } while (Date.now() < end);
  assert.fail("Condition timed out " + JSON.stringify(result));
}
async function join(name = "editor", board = f.a) {
  const { session } = await modules();
  const ticket = await ok(`/boards/${board}/join-tickets`, name, "POST", undefined, 201), p = await driver.connect(`/boards/${board}/join?ticket=${ticket.ticket}`);
  peers.push(p); const joined = await p.next("joined"), doc = new Y.Doc(); docs.push(doc); Y.applyUpdate(doc, session.decode(joined.update));
  await until(() => p.messages.some((m) => m.kind === "comments_snapshot" && m.done));
  return { p, joined, doc };
}
type Client = Awaited<ReturnType<typeof join>>;
// Writes a whole-board change through an adapter bound to the client's document.
async function send(c: Client, change: (board: any) => any, raw?: (doc: Y.Doc) => void) {
  const { adapter, codec, session } = await modules();
  const vector = Y.encodeStateVector(c.doc);
  if (raw) raw(c.doc);
  else { const a = new adapter.Adapter(); a.doc.destroy(); a.doc = c.doc; a.set(change(codec.readBoard(c.doc))); }
  const id = crypto.randomUUID();
  c.p.send({ kind: "edit", epoch: c.joined.epoch, requestId: id, update: session.encode(Y.encodeStateAsUpdate(c.doc, vector)), restoreGeneration: c.joined.restoreGeneration });
  return id;
}
async function answer(c: Client, id: string) {
  const { session } = await modules();
  const result = await until(() => c.p.messages.find((m) => m.requestId === id && ["saved", "refused"].includes(m.kind)));
  if (result!.kind === "saved" && result!.update) Y.applyUpdate(c.doc, session.decode(result!.update));
  return result!;
}
const check = (id: number, name: string, run: () => Promise<void>) => test(`S${id} ${name}`, async () => {
  try { f = await helper("removal-fixture"); await run(); pass++; console.log(`PASS: S${id} ${name}`); }
  catch (error) { fail++; console.log(`FAIL: S${id} ${name}`); throw error; }
});
async function drawing(board: any, kind = 'diamond') {
  const {rules,tape}=await modules();
  const strip=tape.makeTape(board,{x:0,y:0},{x:200,y:60},'dots');
  const next=rules.add({...board,objects:[...board.objects,strip]},'shape',400,200);
  next.objects.at(-1)!.shape=kind as any;return next;
}
async function seedVersion11() {
  const { rules } = await modules(), current = await exported();
  const revision = (await rows("meta")).find((r) => r.key === "revision").value;
  const board = { ...withoutPages(rules.add({ ...rules.empty(), boardId: f.a, title: current.title }, "sticky", 0, 0)), schemaVersion: 11 as const };
  const json = new TextEncoder().encode(rules.canonical(board)), yjs = storedBoardUpdate(board);
  const object = board.objects[0];
  await sql([{ sql: "DELETE FROM snapshot_chunks" }, { sql: "DELETE FROM edits" },
    { sql: `INSERT INTO snapshot_chunks VALUES (?, 'json', 0, ${hex(json)})`, bindings: [revision] },
    { sql: `INSERT INTO snapshot_chunks VALUES (?, 'yjs', 0, ${hex(yjs)})`, bindings: [revision] },
    { sql: "INSERT OR IGNORE INTO identifiers VALUES (?, ?, 0)", bindings: [object.id, object.generation] },
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_capture_sha256'", bindings: [await sha256(json)] },
    { sql: "UPDATE meta SET value = ? WHERE key = 'history_capture_bytes'", bindings: [json.length] }]);
  await driver.wake(f.a); return board;
}
check(407, 'version 11 load upgrades without edits or history and accepts tape and diamond', async()=>{
  await versions(); const before=(await versions()).versions.length, old=await seedVersion11();
  let stored=await exported();assert.equal(stored.schemaVersion,16);assert.deepEqual(stored.objects, (await modules()).rules.upgrade(old).objects);
  await driver.wake(f.a);assert.equal((await exported()).schemaVersion,16);
  const viewer=await join('viewer');await viewer.p.close();await new Promise(r=>setTimeout(r,200));await driver.control({board:f.a,settled:true});
  assert.deepEqual(await rows('edits'),[]);assert.equal((await versions()).versions.length,before);
  const c=await join(), next=await drawing((await modules()).codec.readBoard(c.doc));
  assert.equal((await answer(c,await send(c,()=>next))).kind,'saved');await driver.wake(f.a);
  stored=await exported();assert.equal(stored.schemaVersion,16);assert.deepEqual(stored.objects,next.objects);
});
check(408, 'invalid tape keys geometry pattern and shape kinds or version are refused unchanged',async()=>{
  const before=await exported(), identifiers=await rows('identifiers'),edits=await rows('edits');
  for(const broken of ['three','short','pattern','color','kind','version']) {
    const c=await join(),{adapter,codec}=await modules(),next=await drawing(codec.readBoard(c.doc));
    const request=await send(c,()=>null,doc=>{
      const a=new adapter.Adapter();a.doc.destroy();a.doc=doc;a.set(next);
      const strip=doc.getMap<Y.Map<unknown>>('objects').get(next.objects.find((o:any)=>o.type==='tape')!.id)!;
      const shape=doc.getMap<Y.Map<unknown>>('objects').get(next.objects.at(-1)!.id)!;
      if(broken==='three')strip.set('points',[[14,14],[214,74],[20,20]]);
      if(broken==='short'){strip.set('points',[[14,14],[29,14]]);strip.set('geometry',{x:0,y:0,width:43,height:28});}
      if(broken==='pattern')strip.set('pattern','plaid');if(broken==='color')strip.set('color','red');
      if(broken==='kind')shape.set('shape','hexagon');
      if(broken==='version'){doc.getMap('objects').delete(next.objects.find((o:any)=>o.type==='tape')!.id);shape.set('order',before.objects.length);doc.getMap('board').set('schemaVersion',11);}
    });
    assert.equal((await answer(c,request)).kind,'refused',broken);assert.deepEqual(await exported(),before);assert.deepEqual(await rows('identifiers'),identifiers);assert.deepEqual(await rows('edits'),edits);
  }
});
check(409, 'version 11 history restores as 12 and version 12 keeps tape and star keys',async()=>{
  const {rules}=await modules(),list=await versions(),head=list.head,current=await exported();
  const old={...withoutPages(rules.add({...rules.empty(),boardId:f.a,title:current.title},'sticky',0,0)),schemaVersion:11 as const};
  const data=new TextEncoder().encode(rules.canonical(old)),id=crypto.randomUUID(),object=old.objects[0],ordinal=Math.max(...list.versions.map((v:any)=>v.ordinal))+1;
  await sql([{sql:'INSERT OR IGNORE INTO identifiers VALUES (?, ?, 0)',bindings:[object.id,object.generation]},
    {sql:"INSERT INTO versions VALUES (?, ?, ?, ?, ?, 'manual', 'Old', '', NULL, NULL, '')",bindings:[id,ordinal,Date.now(),head.revision,head.generation]},
    {sql:`INSERT INTO version_chunks VALUES (?, 0, ${hex(data)})`,bindings:[id]},
    {sql:"UPDATE meta SET value = ? WHERE key = 'history_ordinal'",bindings:[ordinal]},
    {sql:"UPDATE meta SET value = ? WHERE key = 'history_revision'",bindings:[head.revision]},
    {sql:"UPDATE meta SET value = ? WHERE key = 'history_capture_sha256'",bindings:[await sha256(data)]},
    {sql:"UPDATE meta SET value = ? WHERE key = 'history_capture_bytes'",bindings:[data.length]}]);
  const restore=async(version:string)=>{const {head}=await versions();return ok(`/boards/${f.a}/versions/${version}/restore`,'owner','POST',{requestId:crypto.randomUUID(),expectedRevision:head.revision,expectedGeneration:head.generation});};
  await restore(id);let stored=await exported();assert.equal(stored.schemaVersion,16);assert.deepEqual(stored.objects, (await modules()).rules.upgrade(old).objects);
  const c=await join(),next=await drawing(stored,'star');assert.equal((await answer(c,await send(c,()=>next))).kind,'saved');
  const saved=await ok(`/boards/${f.a}/versions`,'owner','POST',{requestId:crypto.randomUUID(),name:'Drawing',description:''});
  assert.equal((await answer(c,await send(c,b=>({...b,title:'Changed'})))).kind,'saved');await restore(saved.version.id);
  stored=await exported();assert.equal(stored.schemaVersion,16);assert.deepEqual(stored.objects,next.objects);
});
check(410, 'import accepts tape and all fourteen shapes and refuses invalid tape points',async()=>{
  const {rules,registry}=await modules();let board=await drawing({...rules.empty(),title:'Drawing import'});
  board={...board,objects:board.objects.filter((o:any)=>o.type==='tape')};
  for(const kind of registry.SHAPE_KINDS){board=rules.add(board,'shape',0,0);board.objects.at(-1)!.shape=kind.kind;}
  const made=await ok(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:board.title,document:board},201),stored=await exported(made.id);
  assert.equal(stored.schemaVersion,16);assert.deepEqual(stored.objects,board.objects);
  const bad={...board,objects:board.objects.map((o:any)=>o.type==='tape'?{...o,points:[...o.points,[20,20]]}:o)};
  const refused=await req(`/workspaces/${f.workspace}/boards`,'owner','POST',{title:board.title,document:bad});
  assert.equal(refused.status,400);assert.deepEqual(await refused.json(),{error:{reason:'invalid_document'}});
});
